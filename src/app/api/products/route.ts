import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { getProducts, createProduct } from "@/lib/repositories/product-repository";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const products = await getProducts(auth.organizationId);
  return jsonResponse(products);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const body = await req.json();
  const product = await createProduct(auth, body);
  return jsonResponse(product, 201);
}
