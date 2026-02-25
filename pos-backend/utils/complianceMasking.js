const maskPhone = (value) => {
  const raw = `${value || ""}`.trim();
  if (raw.length <= 4) {
    return raw ? "*".repeat(raw.length) : "";
  }
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-2)}`;
};

const maskEmail = (value) => {
  const raw = `${value || ""}`.trim();
  if (!raw.includes("@")) {
    return raw;
  }

  const [user, domain] = raw.split("@");
  if (!user) {
    return `*@${domain}`;
  }

  if (user.length === 1) {
    return `*@${domain}`;
  }

  return `${user[0]}${"*".repeat(Math.max(user.length - 2, 1))}${user[user.length - 1]}@${domain}`;
};

const maskSensitiveMember = (member = {}) => ({
  ...member,
  phone: maskPhone(member.phone),
  email: maskEmail(member.email),
});

module.exports = {
  maskPhone,
  maskEmail,
  maskSensitiveMember,
};
