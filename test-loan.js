const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase.from('user_loans').insert({
    user_id: crypto.randomUUID(),
    loan_amount: 10,
    amount_repaid: 0,
    currency_id: '35a25fc9-abe2-496a-8247-81527d08fe31',
    repayment_deadline: new Date().toISOString()
  });

  console.log("INSERT ERROR:", error);
}
test();
