import os from 'node:os'

export function lanIpv4Addresses() {
  const addresses = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const addr of list || []) {
      const ipv4 = addr.family === 'IPv4' || addr.family === 4
      if (ipv4 && !addr.internal) addresses.push(addr.address)
    }
  }
  return [...new Set(addresses)]
}

export function listenUrls(port, host = '0.0.0.0') {
  const urls = [`http://localhost:${port}`]
  if (host !== '127.0.0.1' && host !== 'localhost') {
    for (const address of lanIpv4Addresses()) urls.push(`http://${address}:${port}`)
  }
  return urls
}
