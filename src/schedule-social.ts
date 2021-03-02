import subMinutes from 'date-fns/subMinutes';

export const handler = () => {
  const now = new Date();
  const lastMinute = subMinutes(now, 1);
  console.log("Querying posts from", lastMinute, "to", now);
};
