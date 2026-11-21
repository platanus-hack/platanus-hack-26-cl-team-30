# Nexo

<img src="./project-logo.png" alt="Logo del proyecto" width="160" />

Sala compartida donde personas y agentes, cada uno con un rol, toman decisiones críticas en tiempo real. Cada rol recibe solo los datos que le corresponden: el servidor filtra el resto antes de enviarlo. El caso de la demo: dos hospitales compiten por una cama UCI y un Comité, que entra por código QR, aprueba o veta con una razón.

Los datos del caso son simulados. No es una herramienta clínica.

- **Evento:** Platanus Hack 26: Santiago ft. Buk
- **Track:** Multiplayer
- **Deploy:** https://team-30-platanus-hack.onrender.com

## Equipo (team-30)

- Ramón Molina ([@rm004607](https://github.com/rm004607))
- Nahum Mateo Díaz López ([@nadilopoff](https://github.com/nadilopoff))
- Sebastian Vargas Webster ([@iswebster1401](https://github.com/iswebster1401))

## Cómo correrlo

Requiere Node 20.

```bash
npm install
cp .env.example .env.local   # elegir modelo local (Ollama) o Claude
npm run dev                  # http://localhost:3000
npm test                     # pruebas del motor y de los permisos
```

`GET /api/health` dice si el modelo y la base están configurados.

Prueba de carga, solo contra un servidor local:

```bash
node scripts/load-test.mjs http://localhost:3000 50
```

## Arquitectura

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): componentes, tiempo real, modelos y qué existe hoy.
- [`docs/DECISIONES.md`](docs/DECISIONES.md): por qué se eligió cada cosa.
- [`docs/PREGUNTAS.md`](docs/PREGUNTAS.md): preguntas técnicas probables y sus respuestas.

## Deploy

El servicio corre en Render (`render.yaml`) desde un repo personal espejo, porque Render no puede conectarse al repo de la organización. Para que un solo `git push` actualice ambos:

```bash
git remote set-url --add --push origin https://github.com/platanus-hack/platanus-hack-26-cl-team-30.git
git remote set-url --add --push origin https://github.com/<tu-usuario>/<tu-repo>.git
```
