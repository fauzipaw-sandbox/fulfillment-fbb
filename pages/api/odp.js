import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json([]);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let allData = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    // LOOPING: Tarik data per 1.000 baris sampai habis (bypass limit default Supabase)
    while (fetchMore) {
      const { data, error } = await supabase
        .from('odp_kalimantan')
        .select('*')
        .range(from, from + step - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
      }

      // Jika data yang ditarik kurang dari 1.000, berarti itu halaman terakhir
      if (data.length < step) {
        fetchMore = false;
      } else {
        from += step;
      }
    }

    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
