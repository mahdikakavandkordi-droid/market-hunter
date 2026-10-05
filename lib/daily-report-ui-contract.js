// Check stable render hooks, not headings that change with copy or language.
export function dailyReportUiContract(app){
  const start=app.indexOf('function homeHtml()');
  const end=app.indexOf('\nfunction ',start+1);
  const home=start<0?'':app.slice(start,end<0?undefined:end);
  const brief=home.indexOf('id="homeBrief"');
  const markets=home.indexOf('id="homeMarkets"');
  return {
    renders:brief>=0&&home.includes('state.daily')&&home.includes('d?.groups')&&
      home.includes('d?.keyDevelopments')&&home.includes('report-details')&&
      home.includes('d?.executiveSummary'),
    beforeMarkets:brief>=0&&markets>=0&&brief<markets
  };
}
