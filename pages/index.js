const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odp');
      if (res.ok) {
        const odpData = await res.json();
        
        // REKALKULASI STATUS BERDASARKAN RUMUS RSK (OCCUPANCY)
        const enrichedData = (odpData || []).map(item => {
          const isTotal = item.is_total || 0;
          const used = item.used || 0;
          
          // Hitung rsk (Occupancy)
          const rsk = isTotal > 0 ? (used / isTotal) : 0;
          
          // Tentukan status berdasarkan rsk
          let status = 'BLACK';
          if (rsk === 0) {
            status = 'BLACK';
          } else if (rsk < 0.6) {
            status = 'GREEN';
          } else if (rsk < 0.85) {
            status = 'YELLOW';
          } else if (rsk < 0.99) {
            status = 'ORANGE';
          } else {
            status = 'RED';
          }

          return { ...item, status_final: status };
        });

        setData(enrichedData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
