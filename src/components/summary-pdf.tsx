import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  header: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 20 },
  content: { fontSize: 11, lineHeight: 1.6 },
});

interface SummaryDocumentProps {
  patientName: string;
  ownerName: string;
  filename: string;
  content: string;
  date: string;
}

export function SummaryDocument({ patientName, ownerName, filename, content, date }: SummaryDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.header}>Discharge Summary — {patientName}</Text>
          <Text style={styles.meta}>
            Owner: {ownerName} | Source: {filename} | Generated: {new Date(date).toLocaleDateString()}
          </Text>
          <Text style={styles.content}>{content}</Text>
        </View>
      </Page>
    </Document>
  );
}
