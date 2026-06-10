import { Typography, Button } from "antd";
import { GithubOutlined } from "@ant-design/icons";

function Footer() {
  const { Text } = Typography;
  return (
    <footer>
      <div className="ad-support-bar">
        <span className="ad-support-icon" aria-hidden="true">📣</span>
        <span>
          为了本项目的可持续健康发展，诚征校内外研究生招生广告，相关收益将用于支持项目运营。合作联系：
          <a href="mailto:chengensen@foxmail.com">chengensen@foxmail.com</a>
          ，谢谢您的支持！
        </span>
      </div>
      <Text>
        © 2022-2026 Jray
        <Button
          onClick={() => window.open("https://github.com/Jraaay/EmptyClassroom")}
          type="text"
          icon={<GithubOutlined />}
        ></Button>
      </Text>
    </footer>
  );
}

export default Footer;
