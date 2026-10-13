import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { getProduct, updateProduct, deleteProduct } from "@/lib/repositories/product-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const product = await getProduct(id, auth.organizationId);
  if (!product) return errorResponse("Not found", 404);
  return jsonResponse(product);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const body = await req.json();
  const product = await updateProduct(id, auth, body);
  if (!product) return errorResponse("Not found", 404);
  return jsonResponse(product);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  await deleteProduct(id, auth.organizationId);
  return jsonResponse({ success: true });
}
