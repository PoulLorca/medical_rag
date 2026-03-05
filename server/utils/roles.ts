import { useNeon } from "./neon";

export async function isAdmin(userEmail: string): Promise<boolean> {
  const sql = useNeon();

  const result = await sql`
    SELECT role FROM user_roles
    WHERE user_email = ${userEmail} AND role = 'admin'
    `

    return result.length > 0;
}
