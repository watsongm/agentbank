export function mockApi(method, path) {
  if (path.includes("party"))            return {partyId:"P-00291847",name:"Aria Chen",kycStatus:"VERIFIED",riskRating:"LOW",nationality:"GBR"};
  if (path.includes("balance"))          return {accountId:"ACC-1829",available:4821.50,currency:"GBP",dateTime:new Date().toISOString()};
  if (path.includes("accounts"))         return {accounts:[{accountId:"ACC-1829",accountSubType:"CurrentAccount",currency:"GBP"},{accountId:"ACC-2041",accountSubType:"Savings",currency:"GBP"}]};
  if (path.includes("transactions"))     return {transactions:[{id:"TXN-001",amount:-42.50,description:"TESCO STORES",bookingDateTime:"2026-03-22T14:23:00Z"},{id:"TXN-002",amount:2500.00,description:"SALARY PAYMENT",bookingDateTime:"2026-03-20T08:00:00Z"}]};
  if (path.includes("domestic-payments") && method==="POST") return {domesticPaymentId:"PAY-"+Math.floor(Math.random()*9000000+1000000),status:"AcceptedSettlementInProcess",amount:"500.00",currency:"GBP"};
  if (path.includes("consumer-loan") && method==="POST")     return {loanId:"LN-"+Math.floor(Math.random()*90000+10000),status:"UnderReview",requestedAmount:10000,indicativeRate:"6.9%"};
  if (path.includes("consumer-loan"))    return {loanId:"LN-48291",status:"Active",outstandingBalance:7842.33,interestRate:"6.9%",nextPaymentDate:"2026-04-01"};
  if (path.includes("credit-card") && method==="POST") return {cardId:"CRD-"+Math.floor(Math.random()*90000+10000),status:"ApplicationReceived",cardType:"Visa Platinum"};
  if (path.includes("credit-card"))      return {cardId:"CRD-88421",status:"Active",last4:"4291",cardType:"Visa Platinum",creditLimit:5000,availableCredit:3241.80};
  if (path.includes("investment"))       return {portfolioId:"PRT-29183",totalValue:48291.44,currency:"GBP",performanceYTD:"+8.4%",holdings:[{instrument:"AAPL",quantity:12,currentValue:2841.60}]};
  if (path.includes("aml"))             return {screeningId:"AML-"+Math.floor(Math.random()*90000+10000),status:"Clear",riskScore:12,matchesFound:0};
  if (path.includes("savings"))          return {accountId:"SAV-19284",status:"Active",balance:12500.00,interestRate:"4.75%",maturityDate:"2026-12-01"};
  if (path.includes("regulatory"))       return {reportId:"REG-"+Math.floor(Math.random()*90000+10000),status:"Submitted",reportType:"SARReport"};
  if (path.includes("webhook") || path.includes("event")) return {subscriptionId:"SUB-"+Math.floor(Math.random()*90000+10000),status:"Active",eventTypes:["payment.completed","balance.low"]};
  return {status:"success",message:"Operation completed",timestamp:new Date().toISOString()};
}

export function defaultBody(method, path) {
  if (method === "GET") return "";
  if (path.includes("domestic-payments")) return JSON.stringify({data:{initiation:{instructionIdentification:"INSTR-001",instructedAmount:{amount:"500.00",currency:"GBP"},debtorAccount:{identification:"ACC-1829",schemeName:"IBAN"},creditorAccount:{identification:"GB29NWBK60161331926819",schemeName:"IBAN"},remittanceInformation:{reference:"INV-2241"}}},risk:{}},null,2);
  if (path.includes("consumer-loan/initiate")) return JSON.stringify({partyId:"P-00291847",requestedAmount:10000,currency:"GBP",termMonths:36,purpose:"HomeImprovement"},null,2);
  if (path.includes("payment-execution/initiate")) return JSON.stringify({paymentType:"DomesticCredit",amount:{value:500,currency:"GBP"},debtorAccountId:"ACC-1829",creditorIBAN:"GB29NWBK60161331926819"},null,2);
  if (path.includes("webhook")) return JSON.stringify({partyId:"P-00291847",eventTypes:["payment.completed","balance.low"],webhookUrl:"https://your-agent.example.com/events"},null,2);
  return JSON.stringify({note:"Add request body here"},null,2);
}
