import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database credentials missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let allOrders = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    // Loop penarikan data per 1000 baris agar menarik seluruh data
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders_kalimantan')
        .select('*')
        .order('order_ts', { ascending: false })
        .range(from, from + step - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allOrders = allOrders.concat(data);
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    return res.status(200).json(allOrders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
