import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database credentials missing' });
  }

  const { type } = req.query; // 'order' atau 'odp'

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const tableName = type === 'order' ? 'orders_kalimantan' : 'odp_kalimantan';
    const targetCol = type === 'order' ? 'order_id' : 'odp_name';

    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq(targetCol, '___DUMMY_NEQ___');

    if (error) throw error;

    return res.status(200).json({ message: `Semua data tabel ${tableName} berhasil dikosongkan` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
