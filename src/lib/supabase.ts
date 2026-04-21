export const getDbCredentials = () => {
  const url = localStorage.getItem('SUPABASE_URL') || '';
  const key = localStorage.getItem('SUPABASE_KEY') || '';
  return { url, key };
};

export const callSupabaseAPI = async (tableName: string, method: string, payload?: any, queryStr = '') => {
  const { url, key } = getDbCredentials();
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
    // If table not found (404) and it's a GET request, return empty array instead of throwing
    if (response.status === 404 && method.toUpperCase() === 'GET') {
      console.warn(`Table ${tableName} not found, returning empty array.`);
      return [];
    }
    throw new Error(`Supabase API Error (${response.status}): ${errText}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
