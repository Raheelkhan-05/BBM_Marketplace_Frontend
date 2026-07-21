async function getGSTDetails(gstin) {
  const params = new URLSearchParams({
    email: "communication@bbmpvtltd.com",
    gstin,
  });

  const response = await fetch(
    `https://apisandbox.whitebooks.in/public/search?${params}`,
    {
      headers: {
        client_id: "GSTS47144c4f-1b6c-4dfa-aeff-ac92db2e28f3",
        client_secret: "GSTS448727d1-a722-4cfc-960e-bd8bc6dd0b24",
      },
    }
  );

  const { data } = await response.json();

  return {
    gstin: data.gstin,
    legalName: data.lgnm,
    tradeName: data.tradeNam,
    status: data.sts,
    type: data.dty,
    constitution: data.ctb,
    registrationDate: data.rgdt,
    state: data.pradr.addr.stcd,
    city: data.pradr.addr.loc,
    pincode: data.pradr.addr.pncd,
    address: data.pradr.addr,
  };
}

getGSTDetails("27AAGCB1286Q1Z4").then(console.log);