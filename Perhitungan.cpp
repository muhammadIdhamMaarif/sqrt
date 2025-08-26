// mpreal_sqrt_newton.cpp
// Precision square-root with Newton (Heron) and reciprocal-sqrt iterations
// Uses AdvAnPix MPFR C++ wrapper (mpreal): https://github.com/advanpix/mpreal
// - Parses command-line options
// - Allows manual or automatic initial guess
// - Stores per-iteration values, prints and can save CSV
// - Times algorithms in nanoseconds using an independent timer
// - Compares to mpfr builtin sqrt (computed at higher precision) and to std::sqrt (double)
// - Optional BOOST comparison if compiled with -DUSE_BOOST and Boost.Multiprecision available

#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <sstream>
#include <functional>
#include <cstdlib>
#include <algorithm>

#include "mpreal.h" // from the AdvAnPix/mpreal project

// If you want Boost multiprecision comparison, compile with -DUSE_BOOST and have Boost installed
#ifdef USE_BOOST
#include <boost/multiprecision/cpp_dec_float.hpp>
using boost::multiprecision::cpp_dec_float_50; // example type if available
#endif

using mpfr::mpreal;

// Convert decimal digits to bits (roughly)
inline unsigned long digits_to_bits(unsigned long dec_digits) {
    constexpr long double LOG2_10 = 3.321928094887362347870319429489L; // log2(10)
    return static_cast<unsigned long>(std::ceil(dec_digits * LOG2_10));
}

// Independent high-resolution timer: runs a callable and returns pair(result, elapsed_ns)
template<typename F>
auto time_in_ns(F&& f) -> std::pair<decltype(f()), long long> {
    using namespace std::chrono;
    auto t0 = high_resolution_clock::now();
    decltype(f()) result = f();
    auto t1 = high_resolution_clock::now();
    long long ns = duration_cast<nanoseconds>(t1 - t0).count();
    return { result, ns };
}

// Newton/Heron iterations for sqrt(a): x_{n+1} = 0.5*(x_n + a/x_n)
std::pair<mpreal, std::vector<mpreal>> newton_heron(const mpreal& a, mpreal x0, int iterations) {
    std::vector<mpreal> its;
    its.reserve(std::max(1, iterations));
    mpreal x = x0;
    its.push_back(x);
    for (int i = 0; i < iterations; ++i) {
        if (x == 0) { // avoid division by zero
            x = mpreal(0);
            its.push_back(x);
            continue;
        }
        mpreal xnext = (x + a / x) * mpreal(0.5);
        its.push_back(xnext);
        x = xnext;
    }
    return { x, its };
}

// Reciprocal sqrt iterations: y_{n+1} = y_n * (1.5 - 0.5 * a * y_n^2), sqrt = a * y
std::pair<mpreal, std::vector<mpreal>> reciprocal_sqrt(const mpreal& a, mpreal y0, int iterations) {
    std::vector<mpreal> its;
    its.reserve(std::max(1, iterations));
    mpreal y = y0;
    its.push_back(y);
    for (int i = 0; i < iterations; ++i) {
        mpreal y2 = y * y;
        mpreal ynext = y * (mpreal(1.5) - mpreal(0.5) * a * y2);
        its.push_back(ynext);
        y = ynext;
    }
    mpreal sqrt_approx = a * y; // sqrt(a) = a * (1/sqrt(a))
    return { sqrt_approx, its };
}

// Create an automatic initial guess based on the binary exponent (bit-length style seed)
mpreal auto_initial_guess(const mpreal& a) {
    if (a == 0) return mpreal(0);
    if (a < 0) {
        throw std::runtime_error("auto_initial_guess: negative input");
    }
    // compute approximate floor(log2(a)) via mpfr log and convert to long long safely
    mpreal log2a = log(a) / log(mpreal(2));
    long long exp_floor = static_cast<long long>(std::floor(log2a.toDouble()));
    // seed exponent = ceil((exp_floor + 1)/2) -> integer formula (exp_floor + 2)/2
    long long seed_exp = (exp_floor + 2) / 2;
    mpreal x0 = pow(mpreal(2), mpreal(seed_exp));
    return x0;
}

// Write iterations to CSV: iteration,value,abs_error,rel_error
void save_iterations_csv(const std::string& file, const std::vector<mpreal>& its, const mpreal& reference, unsigned int print_digits) {
    std::ofstream ofs(file);
    if (!ofs) {
        std::cerr << "Could not open file for writing: " << file << "\n";
        return;
    }
    ofs << "iteration,value,abs_error,rel_error" << '\n';
    ofs << std::setprecision(print_digits) << std::scientific;
    for (size_t i = 0; i < its.size(); ++i) {
        mpreal val = its[i];
        mpreal abs_err = abs(val - reference);
        mpreal rel_err = reference == 0 ? mpreal(0) : abs_err / abs(reference);
        ofs << i << "," << val << "," << abs_err << "," << rel_err << '\n';
    }
    ofs.close();
}

// Small CLI option parser (very simple)
struct Options {
    std::string number = "2";
    unsigned long prec_digits = 100; // decimal digits of precision
    int iterations = 20;
    std::string init_mode = "auto"; // auto | manual | reciprocal-seed
    std::string init_value = ""; // used when init_mode==manual
    std::string method = "heron"; // heron | recip
    std::string save_csv = "";
    bool show_help = false;
};

Options parse_args(int argc, char** argv) {
    Options opt;
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--help" || a == "-h") { opt.show_help = true; break; }
        if (a == "--number" && i + 1 < argc) opt.number = argv[++i];
        else if (a == "--prec-digits" && i + 1 < argc) opt.prec_digits = static_cast<unsigned long>(std::stoul(argv[++i]));
        else if (a == "--iterations" && i + 1 < argc) opt.iterations = std::stoi(argv[++i]);
        else if (a == "--init-mode" && i + 1 < argc) opt.init_mode = argv[++i];
        else if (a == "--init-value" && i + 1 < argc) opt.init_value = argv[++i];
        else if (a == "--method" && i + 1 < argc) opt.method = argv[++i];
        else if (a == "--save-csv" && i + 1 < argc) opt.save_csv = argv[++i];
        else {
            std::cerr << "Unknown or incomplete argument: " << a << "\n";
            opt.show_help = true;
            break;
        }
    }
    return opt;
}

void print_help() {
    std::cout << "mpreal_sqrt_newton - high-precision sqrt via Newton/Herson and reciprocal-sqrt\n\n";
    std::cout << "Usage:\n  ./mpreal_sqrt_newton [options]\n\n";
    std::cout << "Options:\n";
    std::cout << "  --number <value>        Number to compute sqrt of (decimal string). Default: 2\n";
    std::cout << "  --prec-digits <n>       Decimal digits of precision (default 100)\n";
    std::cout << "  --iterations <n>        Number of Newton iterations to run (default 20)\n";
    std::cout << "  --init-mode <mode>      initial guess mode: auto | manual (default auto)\n";
    std::cout << "  --init-value <val>      initial guess value if init-mode==manual (decimal string)\n";
    std::cout << "  --method <heron|recip>  heron (Newton) or recip (reciprocal-sqrt). default: heron\n";
    std::cout << "  --save-csv <file>       save iteration table to CSV file\n";
    std::cout << "  --help, -h              show this help\n";
}

int main(int argc, char** argv) {
    Options opt = parse_args(argc, argv);
    if (opt.show_help) { print_help(); return 0; }

    // compute and set MPFR precision
    unsigned long bits = digits_to_bits(opt.prec_digits);
    mpfr::mpreal::set_default_prec(bits);

    // Parse input number
    mpreal a;
    try {
        a = mpreal(opt.number);
    }
    catch (...) {
        std::cerr << "Failed to parse number: " << opt.number << "\n";
        return 1;
    }
    if (a < 0) {
        std::cerr << "Negative input: complex results not supported by this program.\n";
        return 1;
    }

    // Build a high-precision reference using extra precision
    unsigned long extra_bits = 64; // extra bits for reference
    unsigned long orig_prec = mpfr::mpreal::get_default_prec();
    unsigned long ref_prec = orig_prec + extra_bits;
    mpfr::mpreal::set_default_prec(ref_prec);
    mpreal a_high = mpreal(opt.number); // construct at higher precision
    mpreal ref_sqrt_high = mpfr::sqrt(a_high);
    // bring reference back to original precision safely by capturing its string with many digits
    std::ostringstream oss_ref;
    unsigned long ref_print_digits = opt.prec_digits + 20; // print extra digits for reference
    oss_ref << std::setprecision(static_cast<int>(ref_print_digits)) << std::scientific << ref_sqrt_high;
    std::string ref_str = oss_ref.str();
    // restore original precision
    mpfr::mpreal::set_default_prec(orig_prec);
    // parse reference string into mpreal at original precision for comparisons
    mpreal reference;
    try {
        reference = mpreal(ref_str);
    }
    catch (...) {
        // fallback: compute sqrt at normal precision
        reference = mpfr::sqrt(a);
    }

    // Prepare initial guess
    mpreal x0;
    if (opt.init_mode == "manual") {
        if (opt.init_value.empty()) {
            std::cerr << "init-mode=manual but --init-value not provided\n";
            return 1;
        }
        x0 = mpreal(opt.init_value);
    }
    else {
        // auto or other modes -> use automatic pre-seed
        x0 = auto_initial_guess(a);
    }

    // if user chooses reciprocal method but provided init_mode manual as sqrt guess, convert to y0
    mpreal y0;
    if (opt.method == "recip") {
        if (opt.init_mode == "manual" && !opt.init_value.empty()) {
            // interpret init_value as sqrt guess -> convert to reciprocal
            mpreal sqrt_guess = mpreal(opt.init_value);
            if (sqrt_guess == 0) {
                std::cerr << "Zero initial guess for reciprocal method invalid\n";
                return 1;
            }
            y0 = 1 / sqrt_guess;
        }
        else {
            // use reciprocal of the auto initial guess
            if (x0 == 0) {
                y0 = mpreal(1); // fallback
            }
            else {
                y0 = 1 / x0;
            }
        }
    }

    // Run chosen method and time it
    std::pair<mpreal, std::vector<mpreal>> raw_result;
    long long elapsed_ns = 0;

    if (opt.method == "heron") {
        auto lambda = [&]() {
            return newton_heron(a, x0, opt.iterations);
            };
        auto timed = time_in_ns(lambda);
        raw_result = timed.first;
        elapsed_ns = timed.second;
    }
    else if (opt.method == "recip") {
        auto lambda = [&]() {
            return reciprocal_sqrt(a, y0, opt.iterations);
            };
        auto timed = time_in_ns(lambda);
        raw_result = timed.first;
        elapsed_ns = timed.second;
    }
    else {
        std::cerr << "Unknown method: " << opt.method << "\n";
        return 1;
    }

    mpreal approx = raw_result.first;
    std::vector<mpreal> iterations = raw_result.second;

    // Compare to builtin sqrt (mpreal) at current precision
    mpreal builtin = mpfr::sqrt(a);

#ifdef USE_BOOST
    // optional Boost comparison (if compiled with USE_BOOST)
    cpp_dec_float_50 boost_a;
    try {
        boost_a = cpp_dec_float_50(opt.number);
    }
    catch (...) {
        // ignore
    }
    cpp_dec_float_50 boost_sqrt = sqrt(boost_a);
#endif

    // Print summary
    std::cout << std::setprecision(static_cast<int>(opt.prec_digits)) << std::scientific;
    std::cout << "Input: " << opt.number << "\n";
    std::cout << "Precision: " << opt.prec_digits << " decimal digits (" << bits << " bits)\n";
    std::cout << "Method: " << opt.method << ", iterations requested: " << opt.iterations << "\n";
    std::cout << "Initial guess (used): " << (opt.method == "heron" ? x0 : y0) << "\n";
    std::cout << "Time elapsed: " << elapsed_ns << " ns\n\n";

    std::cout << "Reference (high-precision) sqrt: " << reference << "\n";
    std::cout << "Builtin mpfr sqrt (current precision): " << builtin << "\n";
    std::cout << "Final approx after iterations: " << approx << "\n";

    mpreal abs_err_final = abs(approx - reference);
    mpreal rel_err_final = (reference == 0) ? mpreal(0) : abs_err_final / abs(reference);
    std::cout << "Absolute error vs reference: " << abs_err_final << "\n";
    std::cout << "Relative error vs reference: " << rel_err_final << "\n\n";

    // Show per-iteration values (including initial value stored as iteration 0)
    std::cout << "Per-iteration table (i, value, abs_error_vs_ref, rel_error_vs_ref)" << "\n";
    for (size_t i = 0; i < iterations.size(); ++i) {
        mpreal val = iterations[i];
        mpreal aerr = abs(val - reference);
        mpreal rerr = (reference == 0) ? mpreal(0) : aerr / abs(reference);
        std::cout << std::setw(4) << i << ": " << val << "  | abs_err=" << aerr << "  | rel_err=" << rerr << "\n";
    }

    if (!opt.save_csv.empty()) {
        save_iterations_csv(opt.save_csv, iterations, reference, static_cast<unsigned int>(opt.prec_digits));
        std::cout << "Saved iterations to: " << opt.save_csv << "\n";
    }

#ifdef USE_BOOST
    std::cout << "\nBoost (cpp_dec_float_50) sqrt: " << boost_sqrt << "\n";
#endif

    // Compare to std::sqrt (double)
    try {
        double d = std::stod(opt.number);
        double ds = std::sqrt(d);
        std::cout << "\nstd::sqrt (double): " << std::setprecision(17) << ds << "\n";
    }
    catch (...) {
        // ignore
    }

    return 0;
}
