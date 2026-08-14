import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/usage";
import { adminRest } from "@/lib/supabase-rest";
import { createBillingPortal } from "@/lib/stripe-rest";
export const runtime="nodejs";
export async function POST(request:Request){try{const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});const rows=await adminRest("profiles",{query:`id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`});const customerId=rows?.[0]?.stripe_customer_id;if(!customerId)return NextResponse.json({error:"No Stripe customer found."},{status:404});const origin=request.headers.get("origin")||process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";const session=await createBillingPortal(customerId,origin);return NextResponse.json({url:session.url});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Billing portal failed."},{status:500});}}
