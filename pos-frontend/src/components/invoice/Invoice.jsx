// 2026-02-26T21:00:00+08:00: i18n
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FaCheck } from "react-icons/fa6";

const Invoice = ({ orderInfo, setShowInvoice }) => {
  const { t } = useTranslation();
  const invoiceRef = useRef(null);
  const handlePrint = () => {
    const printContent = invoiceRef.current.innerHTML;
    const WinPrint = window.open("", "", "width=900,height=650");

    WinPrint.document.write(`
            <html>
              <head>
                <title>${t("invoice.receipt")}</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  .receipt-container { width: 300px; border: 1px solid #ddd; padding: 10px; }
                  h2 { text-align: center; }
                </style>
              </head>
              <body>
                ${printContent}
              </body>
            </html>
          `);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-4 rounded-lg shadow-lg w-[400px]">
        {/* Receipt Content for Printing */}

        <div ref={invoiceRef} className="p-4">
          {/* Receipt Header */}
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
              className="w-12 h-12 border-8 border-green-500 rounded-full flex items-center justify-center shadow-lg bg-green-500"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-2xl"
              >
                <FaCheck className="text-white" />
              </motion.span>
            </motion.div>
          </div>

          <h2 className="text-xl font-bold text-center mb-2">{t("invoice.receipt")}</h2>
          <p className="text-gray-600 text-center">{t("invoice.thankYou")}</p>

          {/* Order Details */}

          <div className="mt-4 border-t pt-4 text-sm text-gray-700">
            <p>
              <strong>{t("invoice.order")}:</strong>{" "}
              {Math.floor(new Date(orderInfo.orderDate).getTime())}
            </p>
            <p>
              <strong>{t("invoice.customer")}:</strong> {orderInfo.customerDetails.name}
            </p>
            <p>
              <strong>{t("invoice.phone")}:</strong> {orderInfo.customerDetails.phone}
            </p>
            <p>
              <strong>{t("invoice.guests")}:</strong> {orderInfo.customerDetails.guests}
            </p>
          </div>

          {/* Items Summary */}

          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold">{t("common.items")}</h3>
            <ul className="text-sm text-gray-700">
              {orderInfo.items.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center text-xs"
                >
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>€{item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bills Summary */}

          <div className="mt-4 border-t pt-4 text-sm">
            <p>
              <strong>{t("invoice.subtotal")}:</strong> €{orderInfo.bills.total.toFixed(2)}
            </p>
            <p>
              <strong>{t("invoice.tax")}:</strong> €{orderInfo.bills.tax.toFixed(2)}
            </p>
            <p className="text-md font-semibold">
              <strong>{t("invoice.total")}:</strong> €
              {orderInfo.bills.totalWithTax.toFixed(2)}
            </p>
          </div>

          {/* Payment Details */}

          <div className="mb-2 mt-2 text-xs">
            {orderInfo.paymentMethod === "Cash" ? (
              <p>
                <strong>{t("invoice.paymentMethod")}:</strong> {orderInfo.paymentMethod}
              </p>
            ) : orderInfo.paymentMethod === "Pending" ? (
              <p>
                <strong>{t("invoice.paymentMethod")}:</strong> Pending (unpaid)
              </p>
            ) : (
              <>
                <p>
                  <strong>{t("invoice.paymentMethod")}:</strong> {orderInfo.paymentMethod}
                </p>
                <p>
                  <strong>Stripe Session ID:</strong>{" "}
                  {orderInfo.paymentData?.stripe_session_id}
                </p>
                <p>
                  <strong>Stripe Payment Intent ID:</strong>{" "}
                  {orderInfo.paymentData?.stripe_payment_intent_id}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-4">
          <button
            onClick={handlePrint}
            className="text-blue-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            {t("cart.printReceipt")}
          </button>
          <button
            onClick={() => setShowInvoice(false)}
            className="text-red-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
