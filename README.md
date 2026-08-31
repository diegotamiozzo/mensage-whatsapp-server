# Sistema de Disparo de WhatsApp (NestJS + React + Baileys)

Aplicação full-stack que integra um back-end em **NestJS** (utilizando a biblioteca **Baileys** para automação do WhatsApp) com um front-end em **React** para envio de mensagens e gerenciamento administrativo da conexão via QR Code.

---

##  Pré-requisitos

Certifique-se de ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Gerenciador de pacotes `npm`

---

##  Como Clonar e Configurar o Projeto

### 1. Clone o repositório

```bash
git clone https://github.com/diegotamiozzo/mensage-whatsapp.git
cd mensage-whatsapp
```

### 2. Configuração e Execução do Back-end

```bash
cd backend
npm install
npm install qrcode
npm install --save-dev @types/qrcode @types/qrcode-terminal
npm run start:dev
```

O servidor NestJS será iniciado (por padrão em `http://localhost:3000`, verifique o `main.ts` para confirmar a porta).

### 3. Configuração e Execução do Front-end

Abra um **novo terminal** na raiz do projeto:

```bash
cd frontend
npm install
npm run dev
```

O Vite iniciará o servidor de desenvolvimento (geralmente em `http://localhost:5173`).

---

##  Estrutura do Projeto

```
├── backend/          # API NestJS + integração Baileys (WhatsApp)
│   └── src/
│       └── whatsapp/  # Módulo responsável pela conexão e envio de mensagens
└── frontend/         # Interface React (dashboard administrativo)
    └── src/
        └── components/
            └── WhatsAppDashboard.jsx
```

---

##  Conectando o WhatsApp

1. Inicie o back-end normalmente.
2. Acesse o dashboard no front-end.
3. Escaneie o **QR Code** exibido com o aplicativo do WhatsApp no celular (Menu > Aparelhos conectados > Conectar um aparelho).
4. As credenciais da sessão serão salvas localmente na pasta `backend/auth_info_baileys/` (esta pasta **não deve ser versionada** — já está no `.gitignore`).

---

##  Aviso

O uso de bibliotecas não oficiais como o Baileys para automação do WhatsApp pode violar os Termos de Serviço da plataforma. Utilize por sua conta e risco, preferencialmente em ambientes de teste ou com números dedicados.

---

##  Desenvolvido por 

Diego Tamiozzo