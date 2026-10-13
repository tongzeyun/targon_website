import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getAuthOrg } from "@/lib/api/auth";
import { checkAlerts } from "@/lib/alert/checker";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await getAuthOrg(req);
    const matches = await checkAlerts(organizationId);
    return jsonResponse({
      count: matches.length,
      alerts: matches.slice(0, 50), // limit to 50
    });
  } catch (error) {
    return errorResponse("获取告警失败: " + (error as Error).message, 500);
  }
}
