#!/usr/bin/env bash
# Run the Spark MLlib forecast job (08) under WSL with the project's JDK + venv.
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/jdk17}"
export PATH="$JAVA_HOME/bin:$PATH"
"${PY:-$HOME/bdavenv/bin/python}" spark/08_mllib_forecast.py
