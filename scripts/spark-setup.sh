#!/usr/bin/env bash
# Deja el DGX Spark sirviendo modelos para el equipo.
# Correr EN el Spark, después del primer arranque oficial de NVIDIA y con buen internet.
# Uso: bash spark-setup.sh
set -euo pipefail

MODELS=("gpt-oss:20b" "qwen3:32b")

echo "==> 1/4 Ollama"
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo "==> 2/4 Exponer Ollama a la red (por defecto solo escucha en localhost)"
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="OLLAMA_KEEP_ALIVE=24h"\n' |
  sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart ollama
sleep 3

echo "==> 3/4 Descargar modelos (decenas de GB: hacerlo antes de ir a la sede)"
for model in "${MODELS[@]}"; do
  ollama pull "$model"
done

echo "==> 4/4 Tailscale, para llegar al Spark desde cualquier red"
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
echo "Falta un paso manual: sudo tailscale up   (abre un enlace para iniciar sesión)"

echo
echo "Listo. Prueba desde un notebook:"
echo "  curl http://$(hostname -I | awk '{print $1}'):11434/v1/models"
echo "Y en .env.local de la app:"
echo "  LLM_BASE_URL=http://$(hostname -I | awk '{print $1}'):11434/v1"
