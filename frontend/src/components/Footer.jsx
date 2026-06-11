import { Typography, Button } from "antd";
import { GithubOutlined } from "@ant-design/icons";

function Footer() {
  const { Text } = Typography;
  return (
    <footer>
      <div className="ad-support-bar">
        <span className="ad-support-icon" aria-hidden="true">📣</span>
        <span>
          为了本项目可持续运营，现以极低价格诚征研究生招生广告。有兴趣合作的同学请致信森林电波工作室：
          <a href="mailto:chengensen@foxmail.com">chengensen@foxmail.com</a>或微信senwich30454
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
