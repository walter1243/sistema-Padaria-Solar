/**
 * Seed inicial do banco Neon com os dados do cardápio.
 * Execute: npx tsx src/lib/db/seed.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { categories, products, addons } from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("🌱 Iniciando seed...");

  // Categorias
  const insertedCategories = await db
    .insert(categories)
    .values([
      { name: "Salgado" },
      { name: "Lanche" },
      { name: "Bebida" },
      { name: "Doce" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ ${insertedCategories.length} categorias inseridas.`);

  // Busca IDs das categorias
  const allCategories = await db.select().from(categories);
  const catMap = Object.fromEntries(allCategories.map((c) => [c.name, c.id]));

  // Produtos
  const insertedProducts = await db
    .insert(products)
    .values([
      {
        name: "Pao na Chapa Premium",
        description: "Pao frances dourado com manteiga de garrafa e toque de ervas.",
        price: "9.90",
        stock: 50,
        categoryId: catMap["Salgado"],
        unit: "un",
        imageUrl:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
        available: true,
      },
      {
        name: "X-Egg Artesanal",
        description: "Hamburguer bovino, ovo cremoso, queijo e maionese da casa.",
        price: "24.90",
        stock: 30,
        categoryId: catMap["Lanche"],
        unit: "un",
        imageUrl:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
        available: true,
      },
      {
        name: "Cafe Gelado de Baunilha",
        description: "Espresso, leite gelado e espuma doce com canela.",
        price: "13.50",
        stock: 40,
        categoryId: catMap["Bebida"],
        unit: "un",
        imageUrl:
          "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
        available: true,
      },
      {
        name: "Torta de Chocolate 70%",
        description: "Fatia intensa com ganache e crocante de castanha.",
        price: "16.00",
        stock: 20,
        categoryId: catMap["Doce"],
        unit: "un",
        imageUrl:
          "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
        available: true,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ ${insertedProducts.length} produtos inseridos.`);

  // Addons por produto
  const prodMap = Object.fromEntries(insertedProducts.map((p) => [p.name, p.id]));

  const addonData = [
    { productId: prodMap["Pao na Chapa Premium"], name: "Requeijao", price: "2.50", description: "Requeijao cremoso" },
    { productId: prodMap["Pao na Chapa Premium"], name: "Queijo extra", price: "3.00", description: "Queijo meia cura" },
    { productId: prodMap["X-Egg Artesanal"], name: "Bacon", price: "4.00", description: "Bacon crocante" },
    { productId: prodMap["X-Egg Artesanal"], name: "Queijo cheddar", price: "3.50", description: "Queijo derretido" },
    { productId: prodMap["X-Egg Artesanal"], name: "Molho especial", price: "1.50", description: "Maionese artesanal" },
    { productId: prodMap["Cafe Gelado de Baunilha"], name: "Chantilly", price: "2.00", description: "Cobertura de chantilly" },
    { productId: prodMap["Cafe Gelado de Baunilha"], name: "Canela", price: "0.50", description: "Polvilho de canela" },
    { productId: prodMap["Cafe Gelado de Baunilha"], name: "Caramelo", price: "1.50", description: "Calda de caramelo" },
    { productId: prodMap["Torta de Chocolate 70%"], name: "Calda extra", price: "2.00", description: "Mais ganache de chocolate" },
  ].filter((a) => a.productId); // ignora se produto nao foi inserido

  if (addonData.length > 0) {
    const insertedAddons = await db.insert(addons).values(addonData).onConflictDoNothing().returning();
    console.log(`✅ ${insertedAddons.length} addons inseridos.`);
  }

  console.log("🎉 Seed concluído!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
