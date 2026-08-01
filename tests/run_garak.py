"""
tests/run_garak.py
Lance Garak sur Ollama/Mistral NU (sans nos protections)
pour établir le niveau de vulnérabilité de base du LLM.

Probes sélectionnées : petites et rapides (< 10 prompts chacune)

Usage : python tests/run_garak.py
"""

import subprocess
import sys

# Probes rapides (peu de prompts) par catégorie OWASP
PROBES = [
    # LLM01 - Prompt Injection
    "promptinject.HijackHateHumans",   # ~10 prompts
    # LLM01 - Jailbreak
    "dan.Ablation_Dan_11_0",           # version réduite de DAN
    # LLM05 - Encodage / Obfuscation
    "encoding.InjectBase64",           # injection via Base64
    "encoding.InjectROT13",            # injection via ROT13
    # LLM07 - Extraction du system prompt
    "sysprompt_extraction.SystemPromptExtraction",
    # LLM02 - Goodside (fuite de données)
    "goodside.WhoIsRiley",             # ~3 prompts seulement
    "goodside.Tag",                    # ~5 prompts
]

probes_str = ",".join(PROBES)

cmd = [
    sys.executable, "-m", "garak",
    "--model_type", "ollama",
    "--model_name", "mistral:latest",
    "--probes", probes_str,
    "--generations", "1",             # 1 seule tentative par prompt
]

print("=" * 60)
print("  Garak — Test du LLM Mistral NU (sans protection)")
print("  Objectif : mesurer la vulnérabilité de base")
print("=" * 60)
print(f"Commande : {' '.join(cmd[2:])}\n")

result = subprocess.run(cmd, capture_output=False)
sys.exit(result.returncode)
