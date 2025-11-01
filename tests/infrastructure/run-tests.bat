@echo off
REM Infrastructure Test Runner for Windows
REM Runs comprehensive infrastructure and deployment tests

setlocal enabledelayedexpansion

REM Configuration
set "TEST_DIR=%~dp0"
set "PROJECT_ROOT=%TEST_DIR%..\.."
set "REPORT_DIR=%TEST_DIR%reports"
set "LOG_FILE=%REPORT_DIR%\test-run.log"

REM Test configuration
if "%TEST_BASE_URL%"=="" set "TEST_BASE_URL=http://localhost"
if "%TEST_HTTPS_URL%"=="" set "TEST_HTTPS_URL=https://localhost"
if "%TEST_TIMEOUT%"=="" set "TEST_TIMEOUT=300000"
if "%TEST_VERBOSE%"=="" set "TEST_VERBOSE=false"

REM Parse command line arguments
set "COMMAND=all"
set "SKIP_CLEANUP=false"

:parse_args
if "%1"=="" goto :main
if "%1"=="--base-url" (
    set "TEST_BASE_URL=%2"
    shift
    shift
    goto :parse_args
)
if "%1"=="--https-url" (
    set "TEST_HTTPS_URL=%2"
    shift
    shift
    goto :parse_args
)
if "%1"=="--timeout" (
    set "TEST_TIMEOUT=%2"
    shift
    shift
    goto :parse_args
)
if "%1"=="--verbose" (
    set "TEST_VERBOSE=true"
    shift
    goto :parse_args
)
if "%1"=="--no-cleanup" (
    set "SKIP_CLEANUP=true"
    shift
    goto :parse_args
)
if "%1"=="all" set "COMMAND=all" & shift & goto :parse_args
if "%1"=="deployment" set "COMMAND=deployment" & shift & goto :parse_args
if "%1"=="security" set "COMMAND=security" & shift & goto :parse_args
if "%1"=="load" set "COMMAND=load" & shift & goto :parse_args
if "%1"=="check" set "COMMAND=check" & shift & goto :parse_args
if "%1"=="help" set "COMMAND=help" & shift & goto :parse_args

echo Unknown option: %1
goto :show_help

:log_info
echo [INFO] %1
echo [INFO] %1 >> "%LOG_FILE%"
goto :eof

:log_success
echo [SUCCESS] %1
echo [SUCCESS] %1 >> "%LOG_FILE%"
goto :eof

:log_warning
echo [WARNING] %1
echo [WARNING] %1 >> "%LOG_FILE%"
goto :eof

:log_error
echo [ERROR] %1
echo [ERROR] %1 >> "%LOG_FILE%"
goto :eof

:setup_test_environment
call :log_info "Setting up test environment..."

REM Create reports directory
if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

REM Initialize log file
echo Infrastructure Test Run - %date% %time% > "%LOG_FILE%"

REM Install test dependencies if needed
if not exist "%TEST_DIR%node_modules" (
    call :log_info "Installing test dependencies..."
    cd /d "%TEST_DIR%"
    npm install
    cd /d "%PROJECT_ROOT%"
)

REM Set environment variables
set "NODE_ENV=test"

call :log_success "Test environment setup completed"
goto :eof

:check_prerequisites
call :log_info "Checking prerequisites..."

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Node.js is not installed"
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    call :log_error "npm is not installed"
    exit /b 1
)

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker is not installed"
    exit /b 1
)

call :log_success "Prerequisites check passed"
goto :eof

:check_services
call :log_info "Checking service availability..."

REM Check frontend service
curl -f -s "%TEST_BASE_URL%/health" >nul 2>&1
if errorlevel 1 (
    call :log_warning "Frontend service not available at %TEST_BASE_URL%"
) else (
    call :log_success "Frontend service is available at %TEST_BASE_URL%"
)

REM Check backend service
curl -f -s "%TEST_BASE_URL%/api/health" >nul 2>&1
if errorlevel 1 (
    call :log_warning "Backend service not available at %TEST_BASE_URL%/api"
) else (
    call :log_success "Backend service is available at %TEST_BASE_URL%/api"
)

goto :eof

:run_deployment_tests
call :log_info "Running deployment tests..."
cd /d "%TEST_DIR%"
npm run test:deployment
if errorlevel 1 (
    call :log_error "Deployment tests failed"
    exit /b 1
) else (
    call :log_success "Deployment tests passed"
)
goto :eof

:run_security_tests
call :log_info "Running security tests..."
cd /d "%TEST_DIR%"
npm run test:security
if errorlevel 1 (
    call :log_error "Security tests failed"
    exit /b 1
) else (
    call :log_success "Security tests passed"
)
goto :eof

:run_load_tests
call :log_info "Running load tests..."
cd /d "%TEST_DIR%"
npm run test:load
if errorlevel 1 (
    call :log_error "Load tests failed"
    exit /b 1
) else (
    call :log_success "Load tests passed"
)
goto :eof

:run_all_tests
call :log_info "Running all infrastructure tests..."
cd /d "%TEST_DIR%"
npm run test:all
if errorlevel 1 (
    call :log_error "Some tests failed"
    exit /b 1
) else (
    call :log_success "All tests passed"
)
goto :eof

:generate_report
call :log_info "Generating test report..."
cd /d "%TEST_DIR%"

REM Generate coverage report
npm run report >nul 2>&1

REM Create summary report
(
echo # Infrastructure Test Report
echo.
echo **Date:** %date% %time%
echo **Environment:** %NODE_ENV%
echo **Base URL:** %TEST_BASE_URL%
echo.
echo ## Test Results
echo.
echo Full test logs available at: %LOG_FILE%
echo.
echo ## Recommendations
echo.
echo - Review test results and fix any issues before deployment
) > "%REPORT_DIR%\summary.md"

call :log_success "Test report generated at %REPORT_DIR%\summary.md"
goto :eof

:cleanup
call :log_info "Cleaning up test environment..."
cd /d "%TEST_DIR%"
if exist ".env.test" del ".env.test"
call :log_success "Cleanup completed"
goto :eof

:show_help
echo Infrastructure Test Runner for Windows
echo.
echo Usage: %0 [command] [options]
echo.
echo Commands:
echo   all         Run all infrastructure tests (default)
echo   deployment  Run deployment tests only
echo   security    Run security tests only
echo   load        Run load tests only
echo   check       Check prerequisites and service availability
echo   help        Show this help message
echo.
echo Options:
echo   --base-url URL     Base URL for testing (default: http://localhost)
echo   --https-url URL    HTTPS URL for testing (default: https://localhost)
echo   --timeout MS       Test timeout in milliseconds (default: 300000)
echo   --verbose          Enable verbose output
echo   --no-cleanup       Skip cleanup after tests
echo.
echo Environment Variables:
echo   TEST_BASE_URL      Base URL for testing
echo   TEST_HTTPS_URL     HTTPS URL for testing
echo   TEST_TIMEOUT       Test timeout in milliseconds
echo   TEST_VERBOSE       Enable verbose output (true/false)
echo   NODE_ENV           Node environment (test/development/production)
goto :eof

:main
if "%COMMAND%"=="help" goto :show_help

if "%COMMAND%"=="check" (
    call :setup_test_environment
    call :check_prerequisites
    call :check_services
    goto :end
)

call :setup_test_environment
call :check_prerequisites
call :check_services

set "exit_code=0"

if "%COMMAND%"=="deployment" (
    call :run_deployment_tests
    if errorlevel 1 set "exit_code=1"
) else if "%COMMAND%"=="security" (
    call :run_security_tests
    if errorlevel 1 set "exit_code=1"
) else if "%COMMAND%"=="load" (
    call :run_load_tests
    if errorlevel 1 set "exit_code=1"
) else (
    call :run_all_tests
    if errorlevel 1 set "exit_code=1"
)

call :generate_report

if "%SKIP_CLEANUP%"=="false" call :cleanup

if "%exit_code%"=="0" (
    call :log_success "Infrastructure tests completed successfully!"
) else (
    call :log_error "Infrastructure tests failed!"
)

:end
exit /b %exit_code%