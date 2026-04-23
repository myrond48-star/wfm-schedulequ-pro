export const fetchConfig = async () => {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    if (data.url && data.key) {
      localStorage.setItem('SUPABASE_URL', data.url);
      localStorage.setItem('SUPABASE_KEY', data.key);
      return data;
    }
  } catch (e) {
    console.error("Failed to fetch server config", e);
  }
  return { url: '', key: '' };
};

export const getDbCredentials = () => {
  const url = localStorage.getItem('SUPABASE_URL') || '';
  const key = localStorage.getItem('SUPABASE_KEY') || '';
  
  // Clean up user input just in case they added /rest/v1 or trailing slashes
  const cleanedUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  
  return { url: cleanedUrl, key };
};

export const callSupabaseAPI = async (tableName: string, method: string, payload?: any, queryStr = '') => {
  let { url, key } = getDbCredentials();
  
  if (!url || !key) {
    // Try fetching from server API once
    const config = await fetchConfig();
    url = config.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    key = config.key;
  }
  
  if (!url || !key) throw new Error("Database API not configured! Please provide URL and Key in System Settings.");

  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  if (method.toLowerCase() === 'post') {
    headers['Prefer'] = 'return=minimal';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (payload) {
    options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  const response = await fetch(`${url}/rest/v1/${tableName}${queryStr}`, options);
  
  if (!response.ok) {
    const errText = await response.text();
    // If table not found (404) and it's a GET request, return empty array silently (optional tables)
    if (response.status === 404 && method.toUpperCase() === 'GET') {
      console.info(`Table ${tableName} not found in database. Using local defaults if available.`);
      return [];
    }
    throw new Error(`Supabase API Error (${response.status}): ${errText}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
