#!/usr/bin/env bash
# Sends one video to Kaggle's free GPU, waits, and saves the upscaled results in out/.
# Needs KAGGLE_API_TOKEN (secret) and KAGGLE_USERNAME. Args: <input.mp4> <movie|anime>
set -euo pipefail
IN="$1"; MODEL="${2:-movie}"; U="$KAGGLE_USERNAME"; DS="motionvault-upscale-input"; K="motionvault-upscaler"
pip install -q --upgrade kaggle
mkdir -p ds kern out
cp "$IN" ds/in.mp4; echo "{\"model\":\"$MODEL\"}" > ds/settings.json
echo "{\"title\":\"$DS\",\"id\":\"$U/$DS\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > ds/dataset-metadata.json
if kaggle datasets status "$U/$DS" >/dev/null 2>&1; then kaggle datasets version -p ds -m "clip $(date -u +%FT%T)" --dir-mode zip -q; else kaggle datasets create -p ds -q; fi
for i in $(seq 1 40); do s=$(kaggle datasets status "$U/$DS" 2>/dev/null || true); echo "dataset: $s"; s=${s,,}; [[ "$s" == *ready* ]] && break; sleep 15; done
cp tools/upscale/kernel.py kern/kernel.py
cat > kern/kernel-metadata.json <<JSON
{"id":"$U/$K","title":"$K","code_file":"kernel.py","language":"python","kernel_type":"script","is_private":true,
 "enable_gpu":true,"enable_internet":true,"dataset_sources":["$U/$DS"],"competition_sources":[],"kernel_sources":[]}
JSON
sleep 30
kaggle kernels push -p kern
for i in $(seq 1 120); do s=$(kaggle kernels status "$U/$K" 2>&1 || true); echo "kernel: $s"; s=${s,,}; [[ "$s" == *complete* ]] && break; [[ "$s" == *error* || "$s" == *cancel* ]] && { kaggle kernels output "$U/$K" -p out || true; cat out/*.log 2>/dev/null | tail -40; exit 1; }; sleep 30; done
kaggle kernels output "$U/$K" -p out
ls -la out
