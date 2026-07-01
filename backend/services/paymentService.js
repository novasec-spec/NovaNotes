import axios from "axios";

export async function createPayment({
  phone,
  amount,
  userId,
  plan
}) {

  const response = await axios.post(
    "https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/",
    {
      phone_number: phone,
      amount,
      currency: "KES",
      api_ref: userId,
      narrative: `NovaNotes ${plan} Premium`
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}
