import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, ProjectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const token = await authApi.login(values);
      setAuth(token.user, token.accessToken, token.refreshToken);
      message.success(`안녕하세요, ${token.user.displayName}님!`);
      navigate('/');
    } catch {
      message.error('아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1F4E79 0%, #2E75B6 100%)',
      }}
    >
      <Card
        style={{ width: 420, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        styles={{ body: { padding: '40px 48px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <ProjectOutlined style={{ fontSize: 48, color: '#1F4E79' }} />
          <Title level={3} style={{ marginTop: 12, marginBottom: 4, color: '#1F4E79' }}>
            WBS 통합 관리 시스템
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            지자체 프로젝트 관리 플랫폼
          </Text>
        </div>

        <Spin spinning={loading}>
          <Form
            name="login"
            onFinish={onFinish}
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '아이디를 입력하세요' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="아이디" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                style={{ height: 44, background: '#1F4E79', borderColor: '#1F4E79' }}
                loading={loading}
              >
                로그인
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default LoginPage;
