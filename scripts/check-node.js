// Verifica a versão do Node antes de instalar (Vite 8 exige 20.19 ou superior).
const [major, minor] = process.versions.node.split('.').map(Number)
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23
if (!ok) {
  console.error(`\nNode.js ${process.versions.node} é antigo demais. Instale a versão LTS em https://nodejs.org (22 ou mais recente).\n`)
  process.exit(1)
}
