# Padaria Prime Web App

Aplicacao web para lanchonete/padaria com dois perfis:

- Cliente: visualiza cardapio e envia pedido
- Admin: gerencia cardapio e acompanha pedidos

## Tecnologias

- Next.js (App Router)
- TypeScript
- Tailwind CSS

## Rotas

- `/` : Cardapio do cliente
- `/admin` : Painel administrativo

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Configuracao

Crie um arquivo `.env.local` baseado em `.env.example`:

```env
NEXT_PUBLIC_ADMIN_PIN=1234
```

## Deploy na Vercel

1. Suba o projeto para um repositorio GitHub.
2. Importe o repositorio na Vercel.
3. Configure a variavel de ambiente `NEXT_PUBLIC_ADMIN_PIN`.
4. Deploy.

## Observacao importante

No estado atual, os dados de cardapio e pedidos ficam em memoria no servidor.
Em ambiente serverless, esses dados podem ser reiniciados quando a instancia dormir/reiniciar.
Para producao, o proximo passo e conectar banco de dados persistente (ex.: Supabase, Neon ou Vercel Postgres).
