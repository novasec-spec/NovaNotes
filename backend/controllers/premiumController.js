import { supabase } from "../config/supabase.js";
import { createPayment } from "../services/paymentService.js";

export const premiumStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        premium: false,
      });
    }

    const active =
      data.status === "active" &&
      new Date(data.expires_at) > new Date();

    return res.json({
      premium: active,
      subscription: data,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      premium: false,
      message: "Failed to fetch subscription status.",
    });
  }
};

export const payPremium = async (req, res) => {
  try {
    const { phone, amount, plan, userId } = req.body;

    // Basic validation
    if (!phone || !amount || !plan || !userId) {
      return res.status(400).json({
        success: false,
        message: "phone, amount, plan and userId are required.",
      });
    }

    const payment = await createPayment({
      phone,
      amount,
      plan,
      userId,
    });

    return res.json(payment);
  } catch (err) {
    console.error(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: "Payment request failed.",
    });
  }
};
