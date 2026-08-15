import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
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
    return res.status(500).json({ error: 'Database credentials missing' });
  }

  const formattedData = req.body;
  if (!Array.isArray(formattedData) || formattedData.length === 0) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('orders_kalimantan')
      .upsert(formattedData, { onConflict: 'order_id' });

    if (error) {
      console.error('Supabase Upsert Error Orders:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Data Order successfully upserted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
