import { v4 as uuidv4 } from "uuid";

export const generateReferralCode = (userId) => {
  // Ví dụ: REF + base36(userId) + 4 ký tự từ uuid
  const suffix = uuidv4().split("-")[0].slice(0, 4).toUpperCase();
  return `REF${Number(userId).toString(36).toUpperCase()}${suffix}`;
};
