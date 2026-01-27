// routes/verified-domains.js
// API endpoint for verified domains monitoring dashboard

export async function getVerifiedDomainsStats(pool) {
  const query = `
    WITH domain_stats AS (
      SELECT 
        vd.domain,
        vd.verified_at,
        vd.created_at as verification_initiated,
        vd.updated_at as last_verification_update,
        
        -- Markdown versions stats
        COUNT(DISTINCT mv.id) FILTER (WHERE mv.is_active = true) as active_markdown_count,
        COUNT(DISTINCT mv.id) as total_markdown_versions,
        MAX(mv.generated_at) FILTER (WHERE mv.is_active = true) as latest_markdown_generated,
        
        -- Discovered pages stats
        COUNT(DISTINCT dp.id) FILTER (WHERE dp.is_active = true) as active_pages_count,
        MAX(dp.last_scanned_at) as last_page_scan,
        MAX(dp.discovered_at) as latest_page_discovery,
        
        -- Croutons stats from source participation
        COALESCE(sp.crouton_count, 0) as crouton_count,
        sp.markdown_exposed,
        sp.discovery_methods,
        sp.last_seen
        
      FROM verified_domains vd
      
      LEFT JOIN markdown_versions mv 
        ON vd.domain = mv.domain
      
      LEFT JOIN discovered_pages dp 
        ON vd.domain = dp.domain
      
      LEFT JOIN (
        SELECT 
          source_domain,
          COUNT(*) as crouton_count,
          BOOL_OR(ai_readable_source) as markdown_exposed,
          ARRAY_AGG(DISTINCT discovery_method) FILTER (WHERE discovery_method IS NOT NULL) as discovery_methods,
          MAX(last_verified) as last_seen
        FROM source_tracking.source_participation
        GROUP BY source_domain
      ) sp ON vd.domain = sp.source_domain
      
      WHERE vd.verified_at IS NOT NULL
      GROUP BY vd.domain, vd.verified_at, vd.created_at, vd.updated_at, 
               sp.crouton_count, sp.markdown_exposed, sp.discovery_methods, sp.last_seen
    )
    SELECT 
      domain,
      verified_at,
      verification_initiated,
      last_verification_update,
      active_markdown_count,
      total_markdown_versions,
      latest_markdown_generated,
      active_pages_count,
      last_page_scan,
      latest_page_discovery,
      crouton_count,
      markdown_exposed,
      discovery_methods,
      last_seen,
      
      -- Health indicators
      CASE 
        WHEN active_markdown_count > 0 THEN 'healthy'
        WHEN total_markdown_versions > 0 THEN 'degraded'
        ELSE 'inactive'
      END as health_status,
      
      -- Days since last activity
      EXTRACT(DAY FROM NOW() - GREATEST(
        COALESCE(latest_markdown_generated, '1970-01-01'::timestamptz),
        COALESCE(last_page_scan, '1970-01-01'::timestamptz),
        COALESCE(last_seen, '1970-01-01'::timestamptz)
      )) as days_since_activity
      
    FROM domain_stats
    ORDER BY verified_at DESC, crouton_count DESC;
  `;
  
  const { rows } = await pool.query(query);
  
  return rows.map(row => ({
    domain: row.domain,
    verified_at: row.verified_at,
    verification_initiated: row.verification_initiated,
    last_verification_update: row.last_verification_update,
    
    // Markdown stats
    markdown: {
      active_count: parseInt(row.active_markdown_count) || 0,
      total_versions: parseInt(row.total_markdown_versions) || 0,
      latest_generated: row.latest_markdown_generated,
      exposed: row.markdown_exposed || false
    },
    
    // Pages stats
    pages: {
      active_count: parseInt(row.active_pages_count) || 0,
      last_scan: row.last_page_scan,
      latest_discovery: row.latest_page_discovery
    },
    
    // Croutons stats
    crouton_count: parseInt(row.crouton_count) || 0,
    discovery_methods: row.discovery_methods || [],
    last_seen: row.last_seen,
    
    // Health
    health_status: row.health_status,
    days_since_activity: parseInt(row.days_since_activity) || 0
  }));
}

// Get detailed info for a specific verified domain
export async function getVerifiedDomainDetail(pool, domain) {
  // Get domain verification info
  const domainQuery = await pool.query(
    'SELECT * FROM verified_domains WHERE domain = $1 AND verified_at IS NOT NULL',
    [domain]
  );
  
  if (domainQuery.rows.length === 0) {
    return null;
  }
  
  const domainInfo = domainQuery.rows[0];
  
  // Get active markdown versions
  const markdownQuery = await pool.query(
    `SELECT id, path, content_hash, generated_at, is_active, created_at
     FROM markdown_versions 
     WHERE domain = $1 
     ORDER BY is_active DESC, generated_at DESC
     LIMIT 50`,
    [domain]
  );
  
  // Get discovered pages
  const pagesQuery = await pool.query(
    `SELECT id, page_url, alternate_href, discovered_at, last_scanned_at, 
            is_active, ingestion_id
     FROM discovered_pages 
     WHERE domain = $1 
     ORDER BY is_active DESC, last_scanned_at DESC NULLS LAST
     LIMIT 100`,
    [domain]
  );
  
  // Get recent croutons
  const croutonsQuery = await pool.query(
    `SELECT crouton_id, source_url, text, confidence, created_at
     FROM croutons
     WHERE source_url LIKE $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [`%${domain}%`]
  );
  
  return {
    domain: domainInfo.domain,
    verified_at: domainInfo.verified_at,
    created_at: domainInfo.created_at,
    updated_at: domainInfo.updated_at,
    markdown_versions: markdownQuery.rows,
    discovered_pages: pagesQuery.rows,
    recent_croutons: croutonsQuery.rows
  };
}
