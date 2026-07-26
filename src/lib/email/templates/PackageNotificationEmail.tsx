import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface PackageNotificationEmailProps {
  userName: string;
  complexName: string;
  unitLabel: string;
  courierCompany: string;
  pin: string;
  receivedAt: string;
  deliveriesUrl: string;
}

export function PackageNotificationEmail({
  userName,
  complexName,
  unitLabel,
  courierCompany,
  pin,
  receivedAt,
  deliveriesUrl,
}: PackageNotificationEmailProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "hola";

  return (
    <Html lang="es">
      <Head />
      <Preview>
        Tienes una nueva encomienda de {courierCompany} en portería
      </Preview>
      <Body
        style={{
          backgroundColor: "#f8fafc",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
            margin: "0 auto",
            maxWidth: "560px",
            padding: "40px 32px",
          }}
        >
          <Section style={{ textAlign: "center" }}>
            <Heading
              as="h1"
              style={{
                color: "#4F46E5",
                fontSize: "28px",
                fontWeight: 700,
                margin: 0,
              }}
            >
              NEXORA
            </Heading>
            <Text style={{ color: "#64748b", fontSize: "13px", margin: "8px 0 0" }}>
              {complexName}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "28px 0" }} />

          <Section>
            <Heading
              as="h2"
              style={{ color: "#0f172a", fontSize: "20px", margin: "0 0 12px" }}
            >
              Hola, {firstName}
            </Heading>
            <Text
              style={{
                color: "#475569",
                fontSize: "15px",
                lineHeight: "24px",
                margin: "0 0 16px",
              }}
            >
              Tienes una nueva encomienda esperando en portería para{" "}
              <strong style={{ color: "#0f172a" }}>{unitLabel}</strong>.
            </Text>
            <Text
              style={{
                color: "#475569",
                fontSize: "15px",
                lineHeight: "24px",
                margin: "0 0 8px",
              }}
            >
              <strong>Mensajería:</strong> {courierCompany}
              <br />
              <strong>Recibido:</strong> {receivedAt}
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#eef2ff",
              borderRadius: "12px",
              marginTop: "20px",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                color: "#64748b",
                fontSize: "12px",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              PIN de retiro
            </Text>
            <Text
              style={{
                color: "#4F46E5",
                fontFamily: "ui-monospace, monospace",
                fontSize: "36px",
                fontWeight: 700,
                letterSpacing: "0.35em",
                margin: "8px 0 0",
              }}
            >
              {pin}
            </Text>
            <Text
              style={{
                color: "#64748b",
                fontSize: "12px",
                margin: "10px 0 0",
              }}
            >
              Muéstralo al vigilante para reclamar tu paquete
            </Text>
          </Section>

          <Section style={{ marginTop: "28px", textAlign: "center" }}>
            <Button
              href={deliveriesUrl}
              style={{
                backgroundColor: "#4F46E5",
                borderRadius: "10px",
                color: "#ffffff",
                display: "inline-block",
                fontSize: "15px",
                fontWeight: 600,
                padding: "14px 28px",
                textDecoration: "none",
              }}
            >
              Ver mis encomiendas
            </Button>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "32px 0 20px" }} />

          <Text
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              lineHeight: "17px",
              margin: 0,
              textAlign: "center",
            }}
          >
            Tu conjunto residencial en un solo lugar ·{" "}
            <Link href={deliveriesUrl} style={{ color: "#4F46E5" }}>
              Abrir NEXORA
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PackageNotificationEmail;
