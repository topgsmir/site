import pg from "pg";

const sellerId = "2eeda1d3-cdd1-4708-9903-70db7436ebdc";
const blocks = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "products",
    title: "فایل‌ها",
    productIds: ["0733e936-309e-49b7-814c-5547908805d9", "c80942c9-eef9-4bce-af37-a4e56069267d"]
  }
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const page = process.argv[2] === "apply" ? blocks : [];
await client.query("UPDATE sellers SET page_blocks = $1::jsonb WHERE id = $2", [JSON.stringify(page), sellerId]);
await client.end();
console.log(page.length ? "applied" : "reverted");
