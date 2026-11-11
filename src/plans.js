const MB = 1024 * 1024;
const GB = 1024 * MB;

const PLANS = [
  {
    sku: 'free',
    name: '免費',
    summary: '1 個個人頁面，可管理 1 間靈堂。約 3 張照片。一個時光膠囊，可設 1 年，分享給 1 位會員。',
    living: 1,
    halls: 1,
    family: 0,
    familySeats: 0,
    bytes: 24 * MB,
    photos: 3,
    videoSeconds: 0,
    frames: 0,
    capsules: 1,
    capsuleYears: [1],
    capsuleShares: 1,
    trusts: 1,
    month: 0,
    year: 0
  },
  {
    sku: 'm99',
    name: '月費 99',
    summary: '1 個個人頁面，可管理 2 間靈堂。約 30 分鐘影片，3 GB。3 個時光膠囊，可設 1 或 3 年，各可分享給 3 位會員。',
    living: 1,
    halls: 2,
    family: 0,
    familySeats: 0,
    bytes: 3 * GB,
    photos: 0,
    videoSeconds: 30 * 60,
    frames: 0,
    capsules: 3,
    capsuleYears: [1, 3],
    capsuleShares: 3,
    trusts: 2,
    month: 99,
    year: 1188
  },
  {
    sku: 'm399',
    name: '月費 399',
    summary: '2 個個人頁面，可管理 3 間靈堂。約 120 分鐘影片，10 GB。3 個時光膠囊，可設 1、3 或 5 年，各可分享給 3 位會員。',
    living: 2,
    halls: 3,
    family: 0,
    familySeats: 0,
    bytes: 10 * GB,
    photos: 0,
    videoSeconds: 120 * 60,
    frames: 0,
    capsules: 3,
    capsuleYears: [1, 3, 5],
    capsuleShares: 3,
    trusts: 3,
    month: 399,
    year: 4788
  },
  {
    sku: 'm699',
    name: '月費 699',
    summary: '3 個個人頁面，可管理 5 間靈堂。約 360 分鐘影片，30 GB。5 個時光膠囊，可設 1、3 或 10 年，各可分享給 5 位會員。',
    living: 3,
    halls: 5,
    family: 0,
    familySeats: 0,
    bytes: 30 * GB,
    photos: 0,
    videoSeconds: 360 * 60,
    frames: 0,
    capsules: 5,
    capsuleYears: [1, 3, 10],
    capsuleShares: 5,
    trusts: 5,
    month: 699,
    year: 8388
  },
  {
    sku: 'm1099',
    name: '月費 1099',
    summary: '5 個個人頁面，可管理 5 間靈堂，另有 1 間家族靈堂可容納 6 位。約 720 分鐘影片，60 GB。7 個時光膠囊，可設 1、3、5、10 或 15 年，各可分享給 7 位會員。',
    living: 5,
    halls: 5,
    family: 1,
    familySeats: 6,
    bytes: 60 * GB,
    photos: 0,
    videoSeconds: 720 * 60,
    frames: 0,
    capsules: 7,
    capsuleYears: [1, 3, 5, 10, 15],
    capsuleShares: 7,
    trusts: 6,
    month: 1099,
    year: 13188
  }
];

function planBySku(sku) {
  return PLANS.find((item) => item.sku === sku) || PLANS[0];
}

function planPrice(plan, cycle) {
  return cycle === 'year' ? plan.year : plan.month;
}

function addCycle(from, cycle) {
  const date = new Date(from);
  if (cycle === 'year') date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

module.exports = { PLANS, planBySku, planPrice, addCycle };
