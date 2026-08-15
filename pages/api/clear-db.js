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

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Hapus semua baris data
    const { error } = await supabase
      .from('odp_kalimantan')
      .delete()
      .neq('odp_name', '___DUMMY_NEQ___');

    if (error) throw error;

    return res.status(200).json({ message: 'Semua data tabel berhasil dikosongkan' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
