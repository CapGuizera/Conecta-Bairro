# ConectaBairro

Aplicação web progressiva (PWA) que conecta moradores a prestadores de serviço e pequenos comerciantes informais do próprio bairro. Mostra **apenas a distância aproximada** entre o morador e o prestador, sem revelar endereço, e concentra a negociação num chat interno.

Projeto da Usina de Projetos Experimentais IV (UPX IV), Centro Universitário FACENS, Sorocaba/SP.
Grupo .lenghtHaters: Caio Nicolini de Queiroz Santos, Guilherme Silveira Maciel, Millene Cristine da Silva e Raíra Haro de Sousa.

---

## Como rodar no Windows

1. Instale o **Node.js 22 LTS** (ou mais recente) em <https://nodejs.org>. Use o instalador padrão e clique em "Next" até o fim.
2. Extraia o ZIP do projeto numa pasta qualquer (por exemplo `Documentos\conecta-bairro`).
3. Dê **dois cliques em `iniciar.bat`**.
   - Na primeira vez ele instala as dependências (precisa de internet, leva de 1 a 3 minutos).
   - Depois abre o navegador em <http://localhost:3000>.
4. Para encerrar, feche a janela preta ou pressione `Ctrl+C` nela.

Não é preciso instalar banco de dados: o PostgreSQL com PostGIS roda embutido (PGlite) e os dados ficam em `server\data\`.

Se o Windows perguntar se o Node.js pode acessar a rede, clique em **Permitir**. Isso é necessário para abrir o sistema pelo celular (veja abaixo).

## Como rodar no Linux ou macOS

```bash
./iniciar.sh
```

## Entrando no sistema

O protótipo roda em **modo demonstração**: não há envio de SMS e o código de verificação aparece na própria tela de login. A tela de login tem atalhos para as contas de demonstração:

| Conta | Celular | O que mostra |
|---|---|---|
| Cleusa Batista | (15) 90000-0001 | Persona 1: prestadora (bolos e salgados), com plano de destaque ativo |
| Thiago Nunes | (15) 90000-0002 | Persona 2: morador contratante |
| Marcelo Duarte | (15) 90000-0003 | Persona 3: prestador técnico |
| Agente de campo | (15) 90000-0005 | Cadastro assistido e levantamento de campo, inclusive offline |
| Moderação | (15) 90000-0006 | Fila de denúncias |
| Associação de Moradores | (15) 90000-0007 | Painel de indicadores do bairro (BI) |

Qualquer outro celular válido cria uma conta nova. Os demais prestadores do bairro fictício usam os números `(15) 90000-0010` a `(15) 90000-0023`.

## Abrindo em outros aparelhos (celular, outro PC)

Com o sistema rodando, o terminal mostra uma linha como:

```
  Na rede local:      http://192.168.0.15:3000
```

Abra esse endereço no celular ou em outro computador **conectado ao mesmo Wi-Fi**. Observações:

- Pelo endereço da rede local (http), o navegador **não libera o GPS**. O sistema avisa e o usuário escolhe o ponto tocando no mapa ou usa o centro do bairro piloto. No próprio computador (`localhost`) o GPS funciona normalmente.
- Se não abrir, libere o Node.js no Firewall do Windows (Painel de Controle > Firewall > Permitir um aplicativo).

## Fluxo para apresentar

1. Entre como **Thiago**, busque "bolo de aniversário" ou "chuveiro queimou" e ajuste o raio.
2. Abra uma oferta, toque em **Conversar com o prestador** e mande uma mensagem com um telefone: ele é removido automaticamente.
3. Toque em **Solicitar este serviço**.
4. Em outra janela anônima (`Ctrl+Shift+N`), entre como o prestador daquela oferta, envie a **proposta** com valor e prazo. Ela aparece na hora para o Thiago.
5. Thiago **aceita**; o prestador **inicia** e **conclui**. A comissão de 6% é apurada e o comprovante fica disponível.
6. Os dois se **avaliam**. A reputação aparece no perfil do prestador.
7. Mostre o **Painel do prestador** (métricas, destaque, confirmação de atividade), o **Cadastro de campo** (agente), a **Moderação** e os **Indicadores** (associação).

## Comandos

| Comando | Para quê |
|---|---|
| `npm start` | Sobe o sistema (após `npm install` e `npm run build`) |
| `npm run dev` | Modo desenvolvimento com recarga automática em <http://localhost:5173> |
| `npm test` | Roda os 19 testes automatizados (regras de negócio, fluxo completo e privacidade) |
| `npm run seed` | **Apaga todos os dados** e recria o bairro de demonstração |
| `npm run build` | Compila a interface para `web/dist` |

## Configuração (`.env`)

O arquivo `.env` é criado na primeira execução a partir de `.env.example`. Os principais itens:

- `PORT`: porta do servidor (padrão 3000).
- `PILOT_LAT` / `PILOT_LNG`: centro do bairro piloto.
- `DATABASE_URL`: deixe vazio para usar o banco embutido, ou aponte para um PostgreSQL com PostGIS.

## Alternativa com Docker (opcional)

Para rodar com PostgreSQL + PostGIS em container (Docker Desktop no Windows):

```bash
docker compose up --build
```

## Requisitos de sistema

- Windows 10/11, Linux ou macOS
- Node.js 20.19+ ou 22.12+ (recomendado: 22 LTS)
- Navegador atualizado (Chrome, Edge, Firefox ou Safari)
- Internet na primeira instalação e para carregar o mapa (OpenStreetMap)

A documentação técnica (arquitetura, requisitos, API e testes) está em [DOCUMENTACAO.md](DOCUMENTACAO.md).
