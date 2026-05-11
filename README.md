# Padaria Solar - Sistema de Cardápio e Pedidos

Aplicacao web profissional para padaria com dois perfis:

- Cliente: visualiza cardapio e envia pedido
- Admin: gerencia cardapio e acompanha pedidos

## Tecnologias

- Next.js (App Router)
- TypeScript
- Tailwind CSS

## Rotas

- `/` : Cardapio do cliente
- `/admin` : Painel administrativo
- `/kitchen` : Painel da cozinha

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Configuracao

Crie um arquivo `.env.local` baseado em `.env.example`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456
ADMIN_SESSION_TOKEN=troque-por-um-token-forte
KITCHEN_USERNAME=cozinha
KITCHEN_PASSWORD=123456
KITCHEN_SESSION_TOKEN=troque-por-um-token-forte-cozinha
```

## Deploy na Vercel

1. Suba o projeto para um repositorio GitHub.
2. Importe o repositorio na Vercel.
3. Configure as variaveis `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_TOKEN`, `KITCHEN_USERNAME`, `KITCHEN_PASSWORD` e `KITCHEN_SESSION_TOKEN`.
4. Deploy.

## Observacao importante

No estado atual, os dados de cardapio e pedidos ficam em memoria no servidor.
Em ambiente serverless, esses dados podem ser reiniciados quando a instancia dormir/reiniciar.
Para producao, o proximo passo e conectar banco de dados persistente (ex.: Supabase, Neon ou Vercel Postgres).
