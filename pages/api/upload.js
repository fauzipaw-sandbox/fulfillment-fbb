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
    return res.status(500).json({ error: 'Database credentials missing on server' });
  }

  const formattedData = req.body;
  if (!Array.isArray(formattedData) || formattedData.length === 0) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  const { type } = req.query; // 'order' atau default odp

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (type === 'order') {
      // Upsert ke tabel orders_kalimantan
      const { error } = await supabase
        .from('orders_kalimantan')
        .upsert(formattedData, { onConflict: 'order_id' });

      if (error) {
        console.error('Supabase Upsert Error Orders:', error);
        return res.status(500).json({ error: `${error.message} (${error.details || error.hint || ''})` });
      }
      return res.status(200).json({ message: 'Data Order successfully upserted' });
    } else {
      // Upsert ke tabel odp_kalimantan
      const { error } = await supabase
        .from('odp_kalimantan')
        .upsert(formattedData, { onConflict: 'odp_name' });

      if (error) {
        console.error('Supabase Upsert Error ODP:', error);
        return res.status(500).json({ error: `${error.message} (${error.details || error.hint || ''})` });
      }
      return res.status(200).json({ message: 'Data ODP successfully upserted' });
    }
  } catch (err) {
    console.error('Server Catch Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
