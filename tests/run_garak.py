"""
tests/run_garak.py
Lance Garak sur Ollama/Llama 3.1 8B nu (sans protections)
pour établir le niveau de vulnérabilité de base du LLM.

Probes sélectionnées : petites et rapides (< 10 prompts chacune)

Usage : python tests/run_garak.py
"""

import subprocess
import sys

# Probes rapides (peu de prompts) par catégorie OWASP
PROBES = [
    # LLM01 - Prompt Injection
    "promptinject.HijackHateHumans",   
    # LLM01 - Jailbreak
    "dan.Ablation_Dan_11_0",           
    # LLM05 - Encodage 
    "encoding.InjectBase64",           
    "encoding.InjectROT13",            
    # LLM07 - Extraction du system prompt
    "sysprompt_extraction.SystemPromptExtraction",
    # LLM02 - Goodside (fuite de données)
    "goodside.WhoIsRiley",            
    "goodside.Tag",                   
]

probes_str = ",".join(PROBES)

cmd = [
    sys.executable, "-m", "garak",
    "--model_type", "ollama",
    "--model_name", "llama3.1:8b",
    "--probes", probes_str,
    "--generations", "1",             # 1 seule tentative par prompt
]

print("=" * 60)
print("  Garak — Test du LLM Llama 3.1 8B nu (sans protection)")
print("  Objectif : mesurer la vulnérabilité de base")
print("=" * 60)
print(f"Commande : {' '.join(cmd[2:])}\n")

result = subprocess.run(cmd, capture_output=False)
sys.exit(result.returncode)
