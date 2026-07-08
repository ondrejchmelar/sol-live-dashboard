// Pushes data.json to a GitHub repo via the Contents API so a GH Pages dashboard
// can serve it. Disabled by default (config.publish.enabled === false); wire up
// owner/repo/token in the Options page when you're ready to go public.

export async function publish(data, pub) {
  if (!pub.owner || !pub.repo || !pub.token) {
    throw new Error('Publish config incomplete (need owner, repo, token).');
  }

  const path = pub.path.split('/').map(encodeURIComponent).join('/');
  const api = `https://api.github.com/repos/${pub.owner}/${pub.repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${pub.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const json = JSON.stringify(data, null, 2);
  const content = toBase64Utf8(json);

  // Need the current blob SHA to update an existing file (omit it to create).
  let sha;
  const getResp = await fetch(`${api}?ref=${encodeURIComponent(pub.branch)}`, { headers });
  if (getResp.ok) {
    sha = (await getResp.json()).sha;
  } else if (getResp.status !== 404) {
    throw new Error(`GET contents failed: ${getResp.status}`);
  }

  const putResp = await fetch(api, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update ${pub.path} — ${data.tournament || 'tournament'} @ ${data.updatedAt || new Date().toISOString()}`,
      content,
      sha,
      branch: pub.branch
    })
  });
  if (!putResp.ok) {
    throw new Error(`PUT contents failed: ${putResp.status} ${(await putResp.text()).slice(0, 200)}`);
  }
  const body = await putResp.json();
  return { commit: body.commit?.sha?.slice(0, 7) || 'ok' };
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
