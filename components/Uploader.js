const formattedData = results.data
          .map((row) => {
            const isTotal = parseInt(row.is_total) || 0;
            const used = parseInt(row.used) || 0;
            
            // Perhitungan RSK (OCCUPANCY)
            const rsk = isTotal > 0 ? (used / isTotal) : 0;
            let statusFinal = 'BLACK';
            if (rsk === 0) {
              statusFinal = 'BLACK';
            } else if (rsk < 0.6) {
              statusFinal = 'GREEN';
            } else if (rsk < 0.85) {
              statusFinal = 'YELLOW';
            } else if (rsk < 0.99) {
              statusFinal = 'ORANGE';
            } else {
              statusFinal = 'RED';
            }

            return {
              odp_name: row.odp_name,
              event_date: row.event_date,
              noss_id: parseInt(row.noss_id) || null,
              witel: row.witel,
              sto: row.sto,
              longitude: parseFloat(row.longitude) || null,
              latitude: parseFloat(row.latitude) || null,
              avai: parseInt(row.avai) || 0,
              used: used,
              is_total: isTotal,
              status_final: statusFinal, // Status sudah otomatis dihitung
              kabupaten: row.kabupaten,
              branch: row.branch,
              wok: row.wok,
            };
          })
          .filter((item) => item.odp_name);
