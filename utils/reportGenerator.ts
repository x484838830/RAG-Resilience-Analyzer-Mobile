import { OverallResult, PotentialResult } from '../types';

export interface ReportContent {
  summary: string;
  level: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: Record<string, {
    analysis: string;
    actionItems: string[];
    score: number;
    status: 'Excellent' | 'Good' | 'Fair' | 'Critical';
  }>;
}

const getStatus = (score: number): 'Excellent' | 'Good' | 'Fair' | 'Critical' => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Critical';
};

const getDetailedFeedback = (potential: string, score: number) => {
  const status = getStatus(score);
  
  const feedbackDB: Record<string, Record<string, { analysis: string, actions: string[] }>> = {
    Response: {
      Excellent: {
        analysis: "組織具備卓越的應變能力，建立了成熟的緊急應變機制與決策流程。團隊在面對突發干擾時，能展現高度的協作默契與資源調度效率，幾乎不受突發事件影響。",
        actions: [
          "將現有的應變模式標準化，並作為內部教育訓練的標竿案例。",
          "進行高難度的複合式災難演練 (Complex Scenario Drills)，測試極限能力。",
          "評估導入自動化應變工具，進一步縮短反應時間。"
        ]
      },
      Good: {
        analysis: "組織具備良好的應變基礎，大部分標準化事件均能有效處理。但在面對非預期或跨部門的複雜事件時，可能會出現短暫的溝通落差或資源重疊。",
        actions: [
          "檢視並優化跨部門的緊急溝通渠道，確保資訊流動無斷點。",
          "建立代理人機制與多能工培訓，避免單點故障 (Single Point of Failure)。",
          "定期更新業務連續性計畫 (BCP)，確保符合當前營運現狀。"
        ]
      },
      Fair: {
        analysis: "應變機制尚未完全成熟，往往依賴少數核心人員的個人經驗來解決問題。缺乏統一的處置標準，導致應對品質不穩定，且容易造成資源浪費。",
        actions: [
          "立即制定核心業務的標準應變程序 (SOP) 與查核表 (Checklist)。",
          "建立明確的緊急應變小組 (ERT) 架構與職責說明書。",
          "每季舉辦基礎桌上推演 (Tabletop Exercise)，建立團隊共識。"
        ]
      },
      Critical: {
        analysis: "組織缺乏具體的應變計畫，面對干擾時反應遲緩且混亂。決策層級不明確，第一線人員缺乏授權，極易因小事故演變成重大危機。",
        actions: [
          "建立緊急聯絡網 (Call Tree) 與24小時通報機制。",
          "鑑別關鍵業務功能 (Critical Business Functions)，優先保障核心運作。",
          "賦予第一線人員在緊急狀況下的基礎裁量權。"
        ]
      }
    },
    Monitor: {
      Excellent: {
        analysis: "組織擁有全方位的監控網絡，不僅涵蓋內部營運指標，更能敏銳捕捉外部市場與供應鏈的微弱訊號。具備數據驅動的決策文化。",
        actions: [
          "整合AI分析工具，提升異常偵測的精準度與預警時間。",
          "建立供應鏈上下游的資訊共享機制，擴大監控視野。",
          "將監控指標與自動化觸發機制連結，實現即時阻斷風險。"
        ]
      },
      Good: {
        analysis: "關鍵績效指標 (KPI) 與風險指標 (KRI) 運作良好，能掌握大部分營運狀態。唯在非結構化資訊（如社群輿論、法規趨勢）的收集與整合上仍有進步空間。",
        actions: [
          "擴大監控範圍至非財務指標，如資安威脅情資、品牌聲譽。",
          "優化資訊儀表板 (Dashboard) 的視覺化設計，提升判讀效率。",
          "建立定期的風險情報週報機制，向管理層匯報。"
        ]
      },
      Fair: {
        analysis: "監控偏重於事後檢討，缺乏即時性指標。部門間資訊存在孤島效應 (Silo Effect)，導致管理層難以拼湊出完整的風險全貌。",
        actions: [
          "盤點各部門現有的監控報表，識別資訊斷點。",
          "定義領先指標 (Leading Indicators)，從「落後監控」轉向「即時監控」。",
          "建立跨部門的定期營運會議，強制進行資訊交流。"
        ]
      },
      Critical: {
        analysis: "幾乎沒有正式的監控機制，營運如同「盲飛」。問題往往在爆發後才被發現，導致錯失黃金處理時間。",
        actions: [
          "立即盤點關鍵資產與流程，設定基礎監控節點。",
          "建立異常事件回報流程，確保資訊能上達天聽。",
          "導入基礎的監控工具或手動檢查表，並落實每日檢查。"
        ]
      }
    },
    Anticipate: {
      Excellent: {
        analysis: "組織具備極強的前瞻思維，將風險管理融入戰略規劃中。常態性進行情境規劃，能有效預判潛在威脅並提前佈局緩解措施。",
        actions: [
          "與外部智庫或顧問機構合作，獲取更深度的趨勢洞察。",
          "建立「紅隊演練」 (Red Teaming) 機制，主動挑戰現有防禦假設。",
          "將預測模型延伸至長期的氣候變遷或地緣政治風險。"
        ]
      },
      Good: {
        analysis: "對於已知的產業風險有一定掌握度，並有定期進行風險評估。但在新興風險（如生成式AI衝擊、新型態資安攻擊）的識別上可能較為保守。",
        actions: [
          "導入情境規劃 (Scenario Planning) 方法論，探討極端情境。",
          "鼓勵員工參與外部研討會，帶回最新的產業風險資訊。",
          "建立風險預警紅綠燈機制，並制定對應的升級門檻。"
        ]
      },
      Fair: {
        analysis: "風險意識薄弱，往往認為「過去沒發生，未來也不會發生」。預測僅基於歷史數據的線性推估，缺乏對黑天鵝事件的想像力。",
        actions: [
          "從歷史重大事故中學習，分析若發生在今日會有何影響。",
          "建立年度風險盤點會議 (Risk Assessment Workshop)。",
          "蒐集同業的災難案例，進行內部的衝擊分析。"
        ]
      },
      Critical: {
        analysis: "完全缺乏預測機制，處於「救火」模式。對於外部環境變化毫無警覺，由於缺乏準備，任何變動都可能造成重大打擊。",
        actions: [
          "建立基本的SWOT分析，識別外部威脅 (Threats)。",
          "關注相關法規變動與供應商穩定性。",
          "預留緊急預備金或備用資源，以應對不可預測的衝擊。"
        ]
      }
    },
    Learn: {
      Excellent: {
        analysis: "擁有強大的學習型組織文化，將「錯誤」視為寶貴資產。事故後檢討 (Post-Mortem) 深入且不針對個人，能迅速修正流程並更新組織知識庫。",
        actions: [
          "建立自動化的知識管理系統 (KM)，讓經驗能即時檢索。",
          "推動「不責備文化」 (Just Culture) 的深化，鼓勵主動通報近失誤 (Near Miss)。",
          "將學習成果轉化為創新動力，優化現有商業模式。"
        ]
      },
      Good: {
        analysis: "重大事件後會進行檢討，並產出改善報告。但改善措施的追蹤落實度（Close the loop）偶有不足，導致相同類型的問題在一段時間後復發。",
        actions: [
          "建立改善措施追蹤表，定期審核執行進度。",
          "將學到的教訓 (Lessons Learned) 融入新進員工培訓教材。",
          "舉辦內部案例分享會，擴大知識傳播範圍。"
        ]
      },
      Fair: {
        analysis: "學習機制流於形式，檢討會議往往變成「找戰犯」大會，導致員工隱匿問題。缺乏系統性的知識累積，人員離職後經驗隨之流失。",
        actions: [
          "改革檢討會議形式，聚焦於「流程」而非「個人」。",
          "建立簡單的事故資料庫，記錄發生原因與解決方法。",
          "制定「師徒制」 (Mentorship)，確保關鍵知識傳承。"
        ]
      },
      Critical: {
        analysis: "拒絕承認錯誤，習慣掩蓋問題。組織僵化，對於過去的失敗視而不見，重複犯錯的成本極高。",
        actions: [
          "領導層需公開示範承認錯誤並承諾改善，建立心理安全感。",
          "強制執行重大事故的根本原因分析 (RCA)。",
          "建立最基本的事件記錄簿。"
        ]
      }
    }
  };

  const content = feedbackDB[potential][status];
  return { 
    analysis: content.analysis,
    actionItems: content.actions,
    score, 
    status 
  };
};

export const generateReport = (results: OverallResult): ReportContent => {
  const { potentials, overallResilience } = results;
  
  let level = "";
  let summary = "";

  if (overallResilience >= 85) {
    level = "韌性卓越級 (Resilient Leader)";
    summary = `貴組織的整體韌性評分為 ${overallResilience.toFixed(1)}%，達到卓越水準。這顯示組織在應對、監控、預測與學習四個維度上均發展成熟，具備強大的適應力與恢復力，能將潛在危機轉化為競爭優勢。`;
  } else if (overallResilience >= 70) {
    level = "韌性穩健級 (Resilient Performer)";
    summary = `貴組織的整體韌性評分為 ${overallResilience.toFixed(1)}%，表現良好。組織具備堅實的防禦機制，能有效應對大部分常態性風險。建議針對相對弱項進行優化，以提升面對極端情境的承受力。`;
  } else if (overallResilience >= 50) {
    level = "基礎防禦級 (Basic Assurance)";
    summary = `貴組織的整體韌性評分為 ${overallResilience.toFixed(1)}%，具備基礎運作能力。目前多採取被動反應模式，在面對複雜或複合式災害時可能面臨挑戰，建議加速建立系統性的韌性管理架構。`;
  } else {
    level = "風險脆弱級 (Vulnerable)";
    summary = `貴組織的整體韌性評分為 ${overallResilience.toFixed(1)}%，顯示組織韌性存在顯著缺口。目前的營運模式在面對干擾時極為脆弱，建議立即啟動韌性強化專案，優先解決關鍵弱點。`;
  }

  const recommendations: ReportContent['recommendations'] = {};
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const potentialKeys = ['Response', 'Monitor', 'Anticipate', 'Learn'];
  
  potentialKeys.forEach(key => {
    // @ts-ignore
    const pResult: PotentialResult = potentials[key];
    const detailed = getDetailedFeedback(key, pResult.score);
    
    recommendations[key] = detailed;

    if (detailed.score >= 80) {
      strengths.push(`${key} (${detailed.score.toFixed(1)}%): ${detailed.analysis.substring(0, 50)}...`);
    } else if (detailed.score < 60) {
      weaknesses.push(`${key} (${detailed.score.toFixed(1)}%): ${detailed.analysis.substring(0, 50)}...`);
    }
  });

  return {
    summary,
    level,
    strengths,
    weaknesses,
    recommendations
  };
};