import { Column, Img, Row, Section } from '../components';
import { getEmailAssetUrl } from '../utils/asset-url';

export type TemplateDocumentImageProps = {
  assetBaseUrl: string;
  className?: string;
};

export const TemplateDocumentImage = ({ assetBaseUrl, className }: TemplateDocumentImageProps) => {
  return (
    <Section className={className}>
      <Row className="table-fixed">
        <Column />

        <Column>
          <Img
            className="mx-auto h-42"
            src={getEmailAssetUrl(assetBaseUrl, 'static/document.png')}
            alt="Nomia"
          />
        </Column>

        <Column />
      </Row>
    </Section>
  );
};

export default TemplateDocumentImage;
