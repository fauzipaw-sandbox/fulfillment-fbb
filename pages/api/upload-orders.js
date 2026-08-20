import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase secret keys missing.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data kosong' });
  }

  try {
    const { error } = await supabase
      .from('orders_kalimantan')
      .upsert(data, { onConflict: 'order_id' });

    if (error) throw error;

    return res.status(200).json({ success: true, count: data.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
